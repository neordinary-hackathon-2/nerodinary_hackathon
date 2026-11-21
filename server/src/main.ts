import { Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { runMigrations } from './database/migrate.js';
import { AppModule } from './app.module.js';
import { configureApp, GLOBAL_PREFIX } from './app.setup.js';
import { appConfig } from './config/app.config.js';
import { databaseConfig } from './config/database.config.js';
import { setupSwagger, SWAGGER_PATH } from './config/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.enableCors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  });
  app.enableShutdownHooks();
  configureApp(app);
  setupSwagger(app);

  const database = app.get<ConfigType<typeof databaseConfig>>(
    databaseConfig.KEY,
  );
  if (database.migrateOnStart) {
    await runMigrations(app);
  }

  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(`env=${config.env} port=${config.port}`);
  logger.log(`API     : http://localhost:${config.port}/${GLOBAL_PREFIX}`);
  logger.log(`Swagger : http://localhost:${config.port}/${SWAGGER_PATH}`);
}
await bootstrap();
