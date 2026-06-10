import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { OAuthToolkitUser } from '../../core/interfaces/toolkit-options.interface';

export type OAuthClientDocument = HydratedDocument<OAuthClientModel>;
export const OAUTH_CLIENT_MODEL = 'ApiToolkitOAuthClient';

@Schema({ collection: 'oauth_clients', timestamps: true })
export class OAuthClientModel {
  @Prop({ required: true, unique: true })
  clientId!: string;

  @Prop({ required: true })
  clientSecret!: string;

  @Prop({ type: [String], required: false })
  scopes?: string[];

  @Prop({
    type: [
      {
        username: { type: String, required: true },
        password: { type: String, required: true },
        scopes: { type: [String], required: false },
      },
    ],
    required: false,
  })
  users?: OAuthToolkitUser[];
}

export const OAuthClientSchema = SchemaFactory.createForClass(OAuthClientModel);