import { SessionPlatform } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    IsArray,
    IsEnum,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
enum ChatRole {
    user = 'user',
    assistant = 'assistant',
}

class ChatHistoryMessageDto {
    @IsEnum(ChatRole)
    role!: ChatRole;

    @IsString()
    @MaxLength(4000)
    content!: string;
}

export class SendMessageDto {
    @IsString()
    @MaxLength(2000)
    message!: string;

    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => ChatHistoryMessageDto)
    history!: ChatHistoryMessageDto[];

    @IsEnum(SessionPlatform)
    platform!: SessionPlatform;
}
