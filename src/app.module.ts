// Load env, serve the site, and register games.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GamesModule } from './games/games.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GamesModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
