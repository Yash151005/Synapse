# AWS Docker Deploy

This image runs the Next.js web app and exposes one writable volume at `/data`.

## EC2 With EBS Or EFS

Mount your AWS volume on the host, then point Compose at it:

```bash
sudo mkdir -p /mnt/synapse-data
sudo chown -R 1001:1001 /mnt/synapse-data

export SYNAPSE_VOLUME_HOST_PATH=/mnt/synapse-data
docker compose -f docker-compose.aws.yml up -d --build
```

If `SYNAPSE_VOLUME_HOST_PATH` is not set, Compose uses a Docker named volume called `synapse-data`.

## Required Runtime Env

Keep secrets in `.env` on the server or in your AWS secret manager. They are ignored by Docker build and are loaded only at runtime by `docker-compose.aws.yml`.

The app listens on container port `3000`.
