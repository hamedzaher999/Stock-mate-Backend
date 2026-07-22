import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, initializeApp } from 'firebase-admin/app';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
    private app!: App;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        this.app = initializeApp({
            credential: cert({
                projectId: this.configService.get<string>(
                    'FIREBASE_PROJECT_ID',
                ),
                clientEmail: this.configService.get<string>(
                    'FIREBASE_CLIENT_EMAIL',
                ),
                privateKey: (
                    this.configService.get<string>('FIREBASE_PRIVATE_KEY') ?? ''
                ).replace(/\\n/g, '\n'),
            }),
            storageBucket: this.configService.get<string>(
                'FIREBASE_STORAGE_BUCKET',
            ),
        });
    }

    getApp(): App {
        return this.app;
    }
}
