import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configure as serverlessExpress } from '@codegenie/serverless-express';
import express from 'express';
import { AppModule } from './app.module.js';

type LambdaHandler = ReturnType<typeof serverlessExpress>;

// Reuse one Nest app across warm invocations.
let cached: LambdaHandler | undefined;

async function getHandler(): Promise<LambdaHandler> {
  if (!cached) {
    const expressApp = express();
    // Nest runs on this Express app instead of opening its own port.
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );
    await app.init();
    // Turn the Express app into a Lambda handler.
    cached = serverlessExpress({ app: expressApp });
  }
  return cached;
}

// Lambda calls this once per request.
export const handler = async (event: unknown, context: unknown) => {
  const server = await getHandler();
  return server(event, context);
};
