import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [GameController],
  providers: [GameService, PrismaService],
  exports: [GameService],
})
export class AppModule {}
