import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Demo response.
  getHello(): string {
    return 'Hello World!';
  }
}
