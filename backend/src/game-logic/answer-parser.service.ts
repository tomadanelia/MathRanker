import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class GameLogicService {
  constructor(private readonly prismaService: PrismaService) {}

  // Example method to demonstrate usage of PrismaService
  async getGameData(gameId: string) {
    return this.prismaService.game.findUnique({
      where: { id: gameId },
    });
  }

}
