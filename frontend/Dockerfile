FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG PUBLIC_CLERK_PUBLISHABLE_KEY

ENV PUBLIC_CLERK_PUBLISHABLE_KEY=${PUBLIC_CLERK_PUBLISHABLE_KEY}
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
