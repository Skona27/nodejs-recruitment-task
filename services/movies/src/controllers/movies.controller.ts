import {
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PublicMovieDTO, CreateMovieDTO } from '../models/movie.model';
import { User } from '../modules/auth.module';
import { MoviesService } from '../services/movies.service';
import { CreditsService } from '../services/credits.service';
import { CreditsConfig } from '../config/config.interface';

@Controller()
export class MoviesController {
  constructor(
    private moviesService: MoviesService,
    private creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('/movies')
  @ApiTags('movies')
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    isArray: true,
    type: PublicMovieDTO,
    description: 'Get all movies created by user',
  })
  @UseGuards(JwtAuthGuard)
  async getMovies(@Request() req): Promise<PublicMovieDTO[]> {
    const user: User = req.user;
    return this.moviesService.findAll(user.id);
  }

  @Post('/movies')
  @ApiTags('movies')
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    isArray: false,
    type: PublicMovieDTO,
    description: 'Create a movie based on title',
  })
  @UseGuards(JwtAuthGuard)
  async createMovie(
    @Request() req,
    @Body() createMovieDto: CreateMovieDTO,
  ): Promise<PublicMovieDTO> {
    const user: User = req.user;
    const creditsConfig = this.configService.get<CreditsConfig>('credits');
    const allowedCreditsCount = creditsConfig[user.role];

    const existingCreditsCount = await this.creditsService.findMonthlyCount(
      user.id,
    );

    if (existingCreditsCount < allowedCreditsCount) {
      const movie = await this.moviesService.create(user.id, createMovieDto);
      await this.creditsService.create(user.id, movie.id);
      return movie;
    } else {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error: 'Credit limit has been used up',
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
