FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive
ENV HDF5_DISABLE_VERSION_CHECK=2
ENV HDF5_DIR=/usr/lib/x86_64-linux-gnu/hdf5/serial
ENV HDF5_LIBDIR=/usr/lib/x86_64-linux-gnu/hdf5/serial
ENV HDF5_INCDIR=/usr/include/hdf5/serial

RUN apt-get update && apt-get install -y \
    gfortran build-essential \
    python3 python3-pip libmysqlclient-dev python3-dev git make cmake \
    libboost-container-dev python3-dolfin gmsh libgmsh-dev python3-mshr \
    libhdf5-dev libhdf5-serial-dev pkg-config \
    hdf5-tools libhdf5-103 \
    curl netcat \
    octave octave-signal octave-image \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip3 install --no-cache-dir "numpy>=1.20.0,<1.25.0"
RUN pip3 install --no-cache-dir h5py==3.7.0
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . /app

# Copiar script wait-for-it (no necesario con health checks en docker-compose)
# COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
# RUN chmod +x /usr/local/bin/wait-for-it.sh

EXPOSE 5000

# No usar ENTRYPOINT para que el comando completo venga de docker-compose
CMD ["python3", "src/app.py"]
