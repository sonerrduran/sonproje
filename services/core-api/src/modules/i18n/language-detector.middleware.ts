import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LanguageService } from './language.service';

// Augment Express Request to carry the detected language
declare global {
  namespace Express {
    interface Request {
      language: string;
    }
  }
}

@Injectable()
export class LanguageDetectorMiddleware implements NestMiddleware {
  constructor(private readonly languageService: LanguageService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // Priority order:
    // 1. Query param:   ?lang=tr
    // 2. URL prefix:    /tr/lessons
    // 3. User header:   X-User-Language (set by frontend on login)
    // 4. Accept-Language from browser
    // 5. Default: 'en'

    const queryLang = req.query['lang'] as string | undefined;
    const urlLang   = req.path.match(/^\/([a-z]{2})(?:\/|$)/)?.[1];
    const userLang  = req.headers['x-user-language'] as string | undefined;
    const acceptLang = req.headers['accept-language'];

    req.language =
      queryLang ??
      urlLang ??
      userLang ??
      this.languageService.detectFromAcceptLanguage(acceptLang);

    next();
  }
}
