FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

FROM dependencies AS development

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json vitest.config.ts ./
COPY src ./src
COPY templates ./templates
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
COPY templates ./templates
RUN npx prisma generate
RUN npm run build

FROM build AS production-dependencies
RUN npm prune --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S practice -g 10001 \
  && adduser -S practice -u 10001 -G practice \
  && mkdir -p /app/uploads \
  && chown -R practice:practice /app

COPY --from=production-dependencies --chown=practice:practice /app/node_modules ./node_modules
COPY --from=build --chown=practice:practice /app/dist ./dist
COPY --from=build --chown=practice:practice /app/prisma ./prisma
COPY --from=build --chown=practice:practice /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=practice:practice /app/templates ./templates
COPY --chown=practice:practice package.json package-lock.json ./

USER practice
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]

FROM build AS migration

ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]
