FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY

ENV PUBLIC_SUPABASE_URL=${PUBLIC_SUPABASE_URL}
ENV PUBLIC_SUPABASE_ANON_KEY=${PUBLIC_SUPABASE_ANON_KEY}
RUN DEPLOY_TO_AZURE=true npm run build
RUN npm prune --production

FROM node:lts-alpine
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]
