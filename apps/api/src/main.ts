import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api/v1');

    const port = Number(process.env.PORT) || 3000;
    await app.listen(port);

    console.log(`API running on http://localhost:${port}/api/v1`);
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
