## Install in host
# install
```bash
npm install
```

# install gulp (task manager)
```bash
npm install -g gulp
```
# run task serve.dev (see gulpfile.js)
```bash
gulp serve.dev
```

## USE with docker image and get transparent upgrades

# install docker (https://www.docker.com/) and docker-compose (https://docs.docker.com/compose/install/)

```bash

docker-compose pull

docker-compose up

navigate http://localhost:THE_PORT_YOU_WANT

```

The docker images running watch the "absolute_path_for_app_source_code" and build angular2 automatic, only refresh your browser!
