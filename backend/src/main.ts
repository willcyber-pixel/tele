import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });

  const port = Number(process.env.PORT ?? 3000);

  // Bind all interfaces: platforms like Render route to the container's
  // external address, so listening on localhost alone would be unreachable.
  await app.listen(port, '0.0.0.0');
  Logger.log(`Listening on port ${port} (API under /api)`, 'Bootstrap');
}

void bootstrap();
