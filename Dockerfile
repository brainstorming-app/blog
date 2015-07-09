#Pull base image.
FROM ubuntu

# install curl
RUN \
 apt-get clean && apt-get update && \
 apt-get install -y curl

RUN gpg --keyserver pool.sks-keyservers.net --recv-keys 7937DFD2AB06298B2293C3187D33FF9D0246406D 114F43EE0176B71C7BC219DD50A3051F888C628D

ENV NODE_VERSION 0.12.6
ENV NPM_VERSION 2.11.3

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz" \
	&& curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
	&& gpg --verify SHASUMS256.txt.asc \
	&& grep " node-v$NODE_VERSION-linux-x64.tar.gz\$" SHASUMS256.txt.asc | sha256sum -c - \
	&& tar -xzf "node-v$NODE_VERSION-linux-x64.tar.gz" -C /usr/local --strip-components=1 \
	&& rm "node-v$NODE_VERSION-linux-x64.tar.gz" SHASUMS256.txt.asc \
	&& npm install -g npm@"$NPM_VERSION" \
	&& npm cache clear

# Config serve and compile
COPY ./gulpfile.js /app/gulpfile.js
COPY ./tsconfig.json /app/tsconfig.json
COPY ./tsd.json /app/tsd.json
COPY ./typings/ /app/typings/

COPY ./package.json /app/package.json

# Run
WORKDIR /app
RUN npm install
RUN npm install -g gulp

EXPOSE 5555

CMD gulp serve.dev
