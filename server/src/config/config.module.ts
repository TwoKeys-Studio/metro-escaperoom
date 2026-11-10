import { Global, Module } from '@nestjs/common'
import { AppConfig } from './app.config.ts'

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
