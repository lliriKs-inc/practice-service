FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY . .
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev && npm cache clean --force

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

RUN addgroup -S practice -g 10001 \
  && adduser -S practice -u 10001 -G practice \
  && mkdir -p /app/.next/cache \
  && chown -R practice:practice /app

COPY --from=production-dependencies --chown=practice:practice /app/node_modules ./node_modules
COPY --from=build --chown=practice:practice /app/.next ./.next
COPY --from=build --chown=practice:practice /app/public ./public
COPY --from=build --chown=practice:practice /app/next.config.ts ./next.config.ts
COPY --chown=practice:practice package.json package-lock.json ./

USER practice
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
