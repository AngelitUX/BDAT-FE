import numpy as np

def get_skin_properties():
    """
    Returns mechanical properties of skin as an isotropic material.
    
    Returns:
        dict: Dictionary with material properties
            - 'E': Young's modulus [GPa]
            - 'nu': Poisson's ratio
            - 'rho': Density [g/mm³]
            - 'C11', 'C12', 'C13', 'C33', 'C55', 'C66': Elastic constants [g/mm·µs²]
    """
    
    # Typical human skin properties
    # Young's modulus: 0.1-0.5 MPa = 0.0001-0.0005 GPa (soft tissue)
    E_skin = 0.0003  # [GPa] - intermediate value
    
    # Poisson's ratio for soft tissue (nearly incompressible)
    nu_skin = 0.48
    
    # Skin density (similar to water)
    rho_skin = 1.1e-3  # [g/mm³] = 1100 kg/m³
    
    # Calculate elastic constants for isotropic material
    # For isotropic material: C11 = C22 = C33, C12 = C13 = C23, C44 = C55 = C66 = (C11-C12)/2
    
    # Shear modulus G = E / (2*(1+nu))
    G = E_skin / (2.0 * (1.0 + nu_skin))
    
    # Bulk modulus K = E / (3*(1-2*nu))
    K = E_skin / (3.0 * (1.0 - 2.0 * nu_skin))
    
    # Lamé constants
    lambda_lame = K - (2.0/3.0) * G
    mu_lame = G
    
    # Elastic constants in Voigt notation (isotropic material)
    # C11 = C22 = C33 = lambda + 2*mu
    # C12 = C13 = C23 = lambda
    # C44 = C55 = C66 = mu
    
    C11_skin = lambda_lame + 2.0 * mu_lame  # [GPa]
    C12_skin = lambda_lame  # [GPa]
    C13_skin = lambda_lame  # [GPa]
    C33_skin = lambda_lame + 2.0 * mu_lame  # [GPa]
    C55_skin = mu_lame  # [GPa]
    C66_skin = mu_lame  # [GPa]
    
    # Convert to FEniCS units: [GPa] -> [g/mm·µs²]
    # 1 GPa = 1e9 Pa = 1e9 N/m² = 1e9 kg/(m·s²) = 1e-3 g/(mm·µs²)
    conversion_factor = 1e-3
    
    properties = {
        'E': E_skin,  # [GPa]
        'nu': nu_skin,
        'rho': rho_skin,  # [g/mm³]
        'C11': C11_skin * conversion_factor,  # [g/mm·µs²]
        'C12': C12_skin * conversion_factor,
        'C13': C13_skin * conversion_factor,
        'C33': C33_skin * conversion_factor,
        'C55': C55_skin * conversion_factor,
        'C66': C66_skin * conversion_factor,
    }
    
    return properties


def get_attenuation_factor(x, zlim, attenuation_zone_width=None):
    """
    Calculates attenuation factor for lateral edges of skin layers.
    
    Args:
        x: X coordinate (horizontal)
        zlim: Total domain length
        attenuation_zone_width: Width of attenuation zone (default: 20% of zlim)
    
    Returns:
        float: Attenuation factor between 0 (edge) and 1 (center)
    """
    if attenuation_zone_width is None:
        attenuation_zone_width = zlim * 0.2
    
    # Smooth attenuation using cosine function
    if x < attenuation_zone_width:
        # Left edge
        factor = 0.5 * (1.0 - np.cos(np.pi * x / attenuation_zone_width))
    elif x > (zlim - attenuation_zone_width):
        # Right edge
        factor = 0.5 * (1.0 - np.cos(np.pi * (zlim - x) / attenuation_zone_width))
    else:
        # Center (no attenuation)
        factor = 1.0
    
    return factor


if __name__ == "__main__":
    # Properties test
    props = get_skin_properties()
    
    print("=" * 60)
    print("MATERIAL PROPERTIES - SKIN (SOFT TISSUE)")
    print("=" * 60)
    print(f"\nBasic properties:")
    print(f"  Young's modulus (E):     {props['E']:.6f} GPa")
    print(f"  Poisson's ratio (ν):     {props['nu']:.3f}")
    print(f"  Density (ρ):             {props['rho']:.6f} g/mm³ = {props['rho']*1e3:.1f} kg/m³")
    
    print(f"\nElastic constants [g/mm·µs²]:")
    print(f"  C11 = {props['C11']:.6e}")
    print(f"  C12 = {props['C12']:.6e}")
    print(f"  C13 = {props['C13']:.6e}")
    print(f"  C33 = {props['C33']:.6e}")
    print(f"  C55 = {props['C55']:.6e}")
    print(f"  C66 = {props['C66']:.6e}")
    
    print(f"\nRelations:")
    print(f"  C11/C12 = {props['C11']/props['C12']:.3f}")
    print(f"  C55/C11 = {props['C55']/props['C11']:.3f}")
    
    print("\n" + "=" * 60)
    print("Edge attenuation test:")
    print("=" * 60)
    zlim_test = 100.0
    test_positions = [0, 5, 10, 20, 50, 80, 90, 95, 100]
    for x in test_positions:
        factor = get_attenuation_factor(x, zlim_test)
        print(f"  x = {x:5.1f} mm  →  factor = {factor:.4f}")
