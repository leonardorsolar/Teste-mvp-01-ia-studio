import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { UploadController } from './upload.controller';

@Module({
  imports: [],
  controllers: [AppController, UploadController],
  providers: [],
})
export class AppModule {}
