import { Global, Module } from '@nestjs/common';
import { CustomCacheInterceptor } from '../interceptors/cache.interceptor.js';
import { AppCacheService } from './app-cache.service.js';

@Global()
@Module({
  providers: [AppCacheService, CustomCacheInterceptor],
  exports: [AppCacheService, CustomCacheInterceptor],
})
export class AppCacheModule {}
