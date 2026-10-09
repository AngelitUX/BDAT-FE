%% ============================================================
%  GENERADOR DE GRÁFICOS PARA SIMULACIONES BDAT
%  GNU Octave
% ============================================================
% USO: octave --no-gui generate_plots_octave.m input.mat output.png attenuation porosity thickness mesh_size margin pitch [threshold]
%
% ARGUMENTOS:
%   mat_file_path:   Ruta al archivo .mat con resultados
%   output_path:     Ruta de salida para PNG
%   attenuation:     0 (tiempo) o 1 (frecuencia)
%   por:             Porosidad (1-30)
%   plate_thickness: Espesor de la placa (mm)
%   mesh_size:       Tamaño de malla típico (mm)
%   margen:          Margen a bordes de sensores (mm)
%   pR:              Pitch entre receptores (mm)
%   threshold:       Umbral SVD en dB para filtrado de ruido (por defecto -10 dB según código del docente)
% ============================================================

function generate_plots_octave(mat_file_path, output_path, attenuation, por, plate_thickness, mesh_size, margen, pR, threshold)
    %% ============================================================
    %  CONFIGURACIÓN INICIAL
    % ============================================================
    close all
    
    if nargin < 9 || isempty(threshold)
        threshold = -10; % Umbral en dB por defecto según código original del docente para cubrir hasta ~1.8-1.9 MHz
    end
    
    fprintf('\n🎨 GENERADOR DE GRÁFICOS BDAT\n');
    fprintf('═══════════════════════════════════════════════════════════\n');
    fprintf('📂 Archivo de entrada: %s\n', mat_file_path);
    fprintf('📊 Archivo de salida: %s\n', output_path);
    
    %% ------------------------------
    % PARÁMETROS DE SIMULACIÓN
    % ------------------------------
    sim_type = 'time';
    if attenuation == 1
        sim_type = 'freq';
    end
    
    fe         = 20;          % Frecuencia de muestreo [MHz]
    Nf         = 2048;        % Número de puntos en frecuencia
    Nt         = 1024;        % Número de puntos en tiempo
    let        = 16;          % Tamaño de letra para gráficos
    NE         = 5;           % Número de elementos a considerar
    Nk         = 512;         % Número de puntos en dominio k
    clim       = 1.6;         % Límite de velocidad de fase
    
    fprintf('📋 Parámetros:\n');
    fprintf('   Tipo: %s\n', sim_type);
    fprintf('   Porosidad: %d%%\n', por);
    fprintf('   Espesor: %.1f mm\n', plate_thickness);
    fprintf('   Tamaño malla: %.2f mm\n', mesh_size);
    fprintf('   Pitch receptores: %.2f mm\n', pR);
    fprintf('   Umbral SVD (Threshold): %.1f dB\n', threshold);
    
    %% ------------------------------
    % CARGA DE DATOS
    % ------------------------------
    fprintf('\n📖 Cargando datos...\n');
    
    % Verificar que el archivo existe
    if ~exist(mat_file_path, 'file')
        error('❌ Archivo no encontrado: %s', mat_file_path);
    end
    
    % Cargar resultados de simulación
    sim = load(mat_file_path);
    fprintf('✅ Archivo de simulación cargado\n');
    
    % Cargar datos de referencia
    script_dir = fileparts(mfilename('fullpath'));
    ref_file = fullfile(script_dir, 'REF2D_exvivo_Mathilde_Radius_01mm.mat');
    
    use_reference = false;
    if exist(ref_file, 'file')
        ref_data = load(ref_file);
        fprintf('✅ Archivo de referencia cargado\n');
        use_reference = true;
    else
        fprintf('⚠️  Archivo de referencia no encontrado: %s\n', ref_file);
        fprintf('   Se usarán curvas aproximadas\n');
    end
    
    %% ============================================================
    %  DEFINICIÓN DE VARIABLES DE TRABAJO
    % ============================================================
    f = [0 : fe/Nf : 2];              % Vector de frecuencias [MHz]
    t = [0 : Nt-1] * (1/fe);          % Vector de tiempos [µs]
    ef = exp(-1i * 2 * pi * f' * t);  % Matriz exponencial compleja
    
    fprintf('📊 Vector de frecuencias: %d puntos [%.3f, %.3f] MHz\n', length(f), f(1), f(end));
    
    %% ============================================================
    %  PROCESAMIENTO MULTI-EMISOR SEGÚN EL TIPO DE SIMULACIÓN
    % ============================================================
    fprintf('\n🔄 Procesando datos (%s)...\n', sim_type);
    
    if strcmp(sim_type, 'freq')
        % Construcción del campo complejo S
        S_raw = sim.solR_sensors_y + 1i * sim.solI_sensors_y;
        
        if ndims(S_raw) == 3
            n_sources = size(S_raw, 3);
        else
            n_sources = 1;
            S_raw = reshape(S_raw, size(S_raw, 1), size(S_raw, 2), 1);
        end
        
        [NR, Nf_real, ~] = size(S_raw);
        f = linspace(0, 2, Nf_real);
        ef = exp(-1i * 2 * pi * f' * t);
        
        sol_sensors_y_all = zeros(NR, Nt, n_sources);
        for src_idx = 1:n_sources
            s = real(S_raw(:, :, src_idx) * ef);
            s = s - mean(s, 2) * ones(1, Nt);
            sol_sensors_y_all(:, :, src_idx) = s;
        end
        
        fprintf('   Usando datos de frecuencia (%d emisores)\n', n_sources);
    else
        % Para time, usar sol_sensors_y directamente
        if ndims(sim.sol_sensors_y) == 3
            sol_sensors_y_all = sim.sol_sensors_y;
            n_sources = size(sol_sensors_y_all, 3);
        else
            sol_sensors_y_all = reshape(sim.sol_sensors_y, size(sim.sol_sensors_y, 1), size(sim.sol_sensors_y, 2), 1);
            n_sources = 1;
        end
        [NR, ~, ~] = size(sol_sensors_y_all);
        fprintf('   Usando datos temporales (%d emisores)\n', n_sources);
    end
    
    %% ============================================================
    %  CÁLCULO DE ESPECTRO Y VALORES SINGULARES (COMPUESTO MULTI-EMISOR)
    % ============================================================
    fprintf('📊 Número de receptores: %d, Número de emisores: %d\n', NR, n_sources);
    fprintf('📊 Forma de matriz de datos: [%d x %d x %d]\n', size(sol_sensors_y_all, 1), size(sol_sensors_y_all, 2), size(sol_sensors_y_all, 3));
    
    % Ajustar NE para garantizar que NR-NE >= 2 (mínimo para SVD)
    if NR < NE + 2
        NE_original = NE;
        NE = max(1, NR - 2);
        fprintf('⚠️  NR (%d) insuficiente para NE (%d). Ajustando NE a %d\n', NR, NE_original, NE);
    end
    
    % Verificar que haya al menos 3 receptores para generar resultados
    if NR < 3
        error('❌ Número de receptores insuficiente (NR=%d). Se necesitan al menos 3 receptores para generar el espectro. Aumentar sensor_edge_margin o n_receiver.', NR);
    end
    
    k = [0 : Nk-1] * (2*pi / pR / Nk);  % Dominio espacial k [rad/mm]
    
    % Inicializar acumuladores para integrar las contribuciones de todos los emisores
    Normfk_total = zeros(Nk, length(f));
    valsing_total = zeros(length(f), NE);
    
    fprintf('🔄 Calculando SVD y espectro f-k para cada uno de los %d emisores...\n', n_sources);
    for src_idx = 1:n_sources
        sol_cur = sol_sensors_y_all(:, :, src_idx);
        
        % Matriz de retardos espaciales para el emisor actual
        R = NaN(NR-NE, Nt, NE);
        for ne = 1:NE
            R(1:NR-NE, 1:Nt, ne) = sol_cur(ne:NR-NE-1+ne, 1:Nt);
        end
        
        % FFT temporal
        Rf = fft(R, Nf, 2);
        n_freq = length(f);
        Rf = Rf(:, 1:n_freq, :);
        
        for nf = 1:length(f)
            slice = squeeze(Rf(:, nf, :));
            if isvector(slice)
                slice = reshape(slice, [], 1);
            end
            [U, S2, ~] = svd(slice, 0);
            A_mat = Nk * ifft(U, Nk, 1);
            
            s_vals = diag(S2);
            s_len = min(NE, length(s_vals));
            valsing_total(nf, 1:s_len) = valsing_total(nf, 1:s_len) + reshape(s_vals(1:s_len), 1, []);
            
            % Filtrado por umbral (Threshold en dB) según instrucciones del docente:
            % Solo se suman al espectro guided wave los modos cuyos valores singulares superan el umbral
            ind = find(20 * log10(s_vals + 1e-10) > threshold);
            if ~isempty(ind)
                Normfk_total(:, nf) = Normfk_total(:, nf) + (1/(NR-NE)) * sum(abs(A_mat(:, ind)).^2, 2);
            end
        end
    end
    
    % Promedio espectral compuesto sobre todos los emisores
    Normfk = Normfk_total / n_sources;
    valsing = valsing_total / n_sources;
    
    % Normalizar Normfk a [0, 1] para la escala de color
    max_norm = max(Normfk(:));
    if max_norm > 0
        Normfk = Normfk / max_norm;
    end
    
    fprintf('✅ Espectro compuesto multi-emisor calculado (filtrado con threshold = %.1f dB)\n', threshold);
    fprintf('   Rango Normfk: [%.2e, %.2e]\n', min(Normfk(:)), max(Normfk(:)));
    
    %% ============================================================
    %  GENERACIÓN DE GRÁFICOS
    % ============================================================
    fprintf('\n🎨 Generando gráficos...\n');
    
    figure('position', [100 100 1800 700], 'visible', 'off', 'PaperPositionMode', 'auto'); 
    
    %% GRÁFICO 1: SEÑALES ESPACIO-TEMPORALES
    subplot(1,3,1)
    num_receivers_plot = min(30, NR);
    % Señal compuesta / representativa de los receptores
    sol_sensors_display = mean(sol_sensors_y_all, 3);
    M = 0.5 * max(max(abs(sol_sensors_display)));
    if M == 0
        M = 1;
    end
    
    for nn = 1:num_receivers_plot
        plot(t, sol_sensors_display(nn,:)/M + nn, 'k', 'LineWidth', 1); 
        hold on
    end
    if n_sources > 1
        title(sprintf('Spatio-temporal signals (%d TX compound)', n_sources), 'fontsize', let, 'fontname', 'times');
    else
        title('Spatio-temporal signals', 'fontsize', let, 'fontname', 'times');
    end
    xlabel('{\it t}  (\mus)', 'fontsize', let, 'fontname', 'times')
    ylabel('Receiver #', 'fontsize', let, 'fontname', 'times')
    axis([0 50 -1 num_receivers_plot+1])
    set(gca, 'fontsize', let-2, 'fontname', 'times')
    set(gca, 'Position', [0.06 0.15 0.26 0.75])
    
    fprintf('   ✓ Gráfico 1: Señales espacio-temporales (%d TX)\n', n_sources);
    
    %% GRÁFICO 2: VALORES SINGULARES
    subplot(1,3,2)
    for i = 1:NE
        sv_db = 20 * log10(valsing(2:end, i) + 1e-10);
        plot(f(2:end), sv_db, 'LineWidth', 2); 
        hold on
    end
    
    % Línea de umbral (Threshold) solicitada por el profesor en color rojo:
    plot([0 2], [threshold threshold], 'r-', 'LineWidth', 2);
    
    % Escala ajustada con margen para ver claramente la línea roja
    axis([0 2 min(-20, threshold - 5) 85])
    xlabel('{\it f}  (MHz)', 'fontsize', let, 'fontname', 'times')
    ylabel('Singular values (dB)', 'fontsize', let, 'fontname', 'times')
    if n_sources > 1
        title(sprintf('Singular values (dB) (%d TX compound)', n_sources), 'fontsize', let, 'fontname', 'times');
    else
        title('Singular values (dB)', 'fontsize', let, 'fontname', 'times');
    end
    set(gca, 'fontsize', let-2, 'fontname', 'times')
    grid on
    set(gca, 'Position', [0.37 0.15 0.26 0.75])
    
    fprintf('   ✓ Gráfico 2: Valores singulares con línea de umbral en %.1f dB\n', threshold);
    
    %% GRÁFICO 3: ESPECTRO GUIADO
    subplot(1,3,3)
    imagesc(f, k, Normfk); 
    axis('xy')
    xlabel('{\it f} (MHz)', 'fontsize', let, 'fontname', 'times')
    ylabel('{\it k} (rad.mm^{-1})', 'fontsize', let, 'fontname', 'times')
    caxis([0 1])
    if n_sources > 1
        title(sprintf('Guided wave spectrum (%d TX compound)', n_sources), 'fontsize', let, 'fontname', 'times');
    else
        title('Guided wave spectrum image', 'fontsize', let, 'fontname', 'times');
    end
    set(gca, 'fontsize', let-2, 'fontname', 'times')
    % Ajustar posición ANTES del colorbar para dejar espacio
    set(gca, 'Position', [0.68 0.15 0.22 0.75])
    colorbar
    
    %% LÍNEAS DE REFERENCIA
    hold on
    lines_drawn = 0;
    
    if use_reference
        try
            fprintf('\n📊 Dibujando líneas de referencia...\n');
            
            % Buscar índices
            if isfield(ref_data, 'portest') && isfield(ref_data, 'etest')
                portest = ref_data.portest(:);
                etest = ref_data.etest(:);
                
                fprintf('   Valores disponibles - porosity: [%s]\n', num2str(portest'));
                fprintf('   Valores disponibles - thickness: [%s]\n', num2str(etest'));
                
                % Buscar índice de porosidad
                npor_idx = find(portest == por);
                if ~isempty(npor_idx)
                    npor = npor_idx(1);
                    fprintf('   ✓ Porosidad %d%% encontrada en índice %d\n', por, npor);
                else
                    npor = por;  % Fallback a índice directo
                    fprintf('   ⚠️  Porosidad %d%% no encontrada, usando índice %d\n', por, npor);
                end
                
                % Buscar índice de espesor
                ep_rounded = round(plate_thickness);
                nep_idx = find(etest == ep_rounded);
                if ~isempty(nep_idx)
                    nep = nep_idx(1);
                    fprintf('   ✓ Espesor %d mm encontrado en índice %d\n', ep_rounded, nep);
                else
                    % Usar el más cercano
                    [~, nep] = min(abs(etest - plate_thickness));
                    fprintf('   ⚠️  Espesor %.1f mm no encontrado\n', plate_thickness);
                    fprintf('   Usando espesor más cercano: %.1f mm (índice %d)\n', etest(nep), nep);
                end
            else
                % Fallback a índices directos
                npor = por;
                nep = round(plate_thickness);
                fprintf('   ⚠️  portest/etest no encontrados, usando índices directos\n');
            end
            
            % Extraer k_ref
            if isfield(ref_data, 'k_ref2D_coupe_v2')
                k_ref_struct = ref_data.k_ref2D_coupe_v2;
                fprintf('   k_ref2D_coupe_v2 shape: [%d x %d]\n', size(k_ref_struct, 1), size(k_ref_struct, 2));
                
                if npor <= size(k_ref_struct, 2)
                    k_ref_item = k_ref_struct(1, npor);
                    
                    if isfield(k_ref_item, 'k_ref')
                        k_ref = k_ref_item.k_ref;
                        fprintf('   k_ref shape: [%d x %d x %d]\n', size(k_ref, 1), size(k_ref, 2), size(k_ref, 3));
                        
                        % Verificar y ajustar nep
                        if nep > size(k_ref, 3)
                            fprintf('   ⚠️  nep=%d fuera de rango (máximo=%d)\n', nep, size(k_ref, 3));
                            nep = size(k_ref, 3);
                            fprintf('   Ajustando a nep=%d\n', nep);
                        end
                        
                        k_ref_slice = k_ref(:, :, nep);
                        f_ref = linspace(0, 2, size(k_ref_slice, 1));
                        
                        fprintf('   Dibujando %d modos...\n', size(k_ref_slice, 2));
                        
                        % Dibujar todos los modos
                        for mode_idx = 1:size(k_ref_slice, 2)
                            k_mode = k_ref_slice(:, mode_idx);
                            valid = ~isnan(k_mode) & (k_mode > 0) & (k_mode <= 7);
                            
                            if any(valid)
                                plot(f_ref(valid), k_mode(valid), 'w-', 'LineWidth', 2);
                                lines_drawn = lines_drawn + 1;
                            end
                        end
                        
                        fprintf('   ✅ %d líneas dibujadas desde archivo de referencia\n', lines_drawn);
                    else
                        fprintf('   ⚠️  Campo k_ref no encontrado\n');
                    end
                else
                    fprintf('   ⚠️  npor=%d fuera de rango\n', npor);
                end
            else
                fprintf('   ⚠️  k_ref2D_coupe_v2 no encontrado\n');
            end
            
        catch err
            fprintf('   ⚠️  Error cargando referencia: %s\n', err.message);
        end
    end
    
    % FALLBACK: Curvas aproximadas
    if lines_drawn == 0
        fprintf('   ⚠️  Usando curvas de dispersión aproximadas\n');
        f_approx = linspace(0, 2, 200);
        
        % Modo A0
        k_A0 = 2 * pi * f_approx / 2.2;
        valid_A0 = k_A0 <= 7;
        plot(f_approx(valid_A0), k_A0(valid_A0), 'w-', 'LineWidth', 2);
        
        % Modo S0
        k_S0 = 2 * pi * f_approx / 3.8;
        valid_S0 = k_S0 <= 7;
        plot(f_approx(valid_S0), k_S0(valid_S0), 'w-', 'LineWidth', 2);
        
        % Modo A1
        k_A1 = zeros(size(f_approx));
        k_A1(f_approx > 0.8) = 2 * pi * f_approx(f_approx > 0.8) / 1.8;
        valid_A1 = (k_A1 > 0) & (k_A1 <= 7);
        if any(valid_A1)
            plot(f_approx(valid_A1), k_A1(valid_A1), 'w-', 'LineWidth', 2);
        end
        
        % Modo S1
        k_S1 = zeros(size(f_approx));
        k_S1(f_approx > 1.0) = 2 * pi * f_approx(f_approx > 1.0) / 2.5;
        valid_S1 = (k_S1 > 0) & (k_S1 <= 7);
        if any(valid_S1)
            plot(f_approx(valid_S1), k_S1(valid_S1), 'w-', 'LineWidth', 2);
        end
        
        fprintf('   ✅ 4 curvas aproximadas dibujadas\n');
    end
    
    hold off
    
    % Cálculo de máscara
    klim = 2 * pi * f / clim + 0.5;
    test = k' * ones(1, length(f));
    mask = (test > klim);
    val = sum(sum(Normfk .* mask)) / sum(sum(mask));
    fprintf('   📊 Pixeles: Valor = %.4f\n', val);
    
    axis([0 2 0 7])
    
    fprintf('   ✓ Gráfico 3: Espectro guiado (filtrado)\n');
    
    %% ============================================================
    %  GUARDAR IMAGEN
    % ============================================================
    fprintf('\n💾 Guardando gráfico...\n');
    
    % Asegurar que el directorio existe
    output_dir = fileparts(output_path);
    if ~isempty(output_dir) && ~exist(output_dir, 'dir')
        mkdir(output_dir);
        fprintf('   📁 Directorio creado: %s\n', output_dir);
    end
    
    % Guardar figura como PNG
    print(output_path, '-dpng', '-r150');
    
    % Verificar que se guardó
    if exist(output_path, 'file')
        file_info = dir(output_path);
        fprintf('✅ Gráfico guardado exitosamente\n');
        fprintf('   📂 Ruta: %s\n', output_path);
        fprintf('   📏 Tamaño: %d bytes\n', file_info.bytes);
    else
        error('❌ Error: El archivo no se guardó correctamente');
    end
    
    close all
    
    fprintf('\n✓ Proceso completado exitosamente!\n');
    fprintf('═══════════════════════════════════════════════════════════\n\n');
end
