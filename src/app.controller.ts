import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Demo route.
  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}
