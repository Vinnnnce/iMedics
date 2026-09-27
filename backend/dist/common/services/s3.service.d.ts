export declare class S3Service {
    private s3;
    private bucket;
    constructor();
    uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string>;
    getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
