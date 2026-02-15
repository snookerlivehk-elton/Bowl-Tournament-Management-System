import { Injectable } from '@nestjs/common'
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class StorageService {
  client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })

  async createUploadPost(mime: string, size: number) {
    const key = `${new Date().toISOString().slice(0, 10)}/${uuidv4()}`
    const bucket = process.env.R2_BUCKET || ''
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, size],
        ['starts-with', '$Content-Type', ''],
      ],
      Fields: {
        'Content-Type': mime,
      },
      Expires: 300,
    })
    return { url, fields, key, bucket }
  }
}
