FROM node:24-bookworm-slim
ENV NODE_ENV=production MODE=online DATABASE_PATH=/data/chameleon.sqlite PORT=3000
WORKDIR /app
COPY --chown=node:node package.json server.js index.html helper.html ./
COPY --chown=node:node game ./game
COPY --chown=node:node web ./web
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
