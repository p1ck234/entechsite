export interface DriveFileItem {
    id: string;
    name: string;
    mimeType?: string;
    webViewLink: string;
    modifiedTime?: string;
}
export interface DriveCourseFolder extends DriveFileItem {
    lessons: DriveFileItem[];
}
export declare const getTrainingDriveTree: () => Promise<{
    root: DriveFileItem;
    courses: DriveCourseFolder[];
}>;
export declare const getLifeDriveItems: () => Promise<{
    root: DriveFileItem;
    items: DriveFileItem[];
}>;
export declare const DRIVE_IMAGE_REF_PREFIX = "drive:";
export declare const toDriveImageRef: (fileId: string) => string;
export declare const parseDriveImageRef: (value: string) => string | null;
export declare const extractDriveResourceIdFromUrl: (url: string) => string | null;
export type DriveMediaKind = 'image' | 'video';
export type DriveContentKind = 'image' | 'video' | 'pdf' | 'audio';
export declare const getDriveContentKind: (mimeType?: string) => DriveContentKind | null;
export declare const getDriveMediaKind: (mimeType?: string) => DriveMediaKind | null;
export declare const listMediaInDriveResource: (resourceIdOrUrl: string) => Promise<DriveFileItem[]>;
export declare const listLessonMaterialsInDriveResource: (resourceIdOrUrl: string) => Promise<DriveFileItem[]>;
export declare const listImagesInDriveResource: (resourceIdOrUrl: string) => Promise<DriveFileItem[]>;
export interface DriveMediaStreamResult {
    stream: NodeJS.ReadableStream;
    mimeType: string;
    name: string;
    totalSize?: number;
    contentRange?: string;
    statusCode: 200 | 206;
}
export declare const streamDriveMediaContent: (fileId: string, rangeHeader?: string) => Promise<DriveMediaStreamResult>;
export declare const readDriveFileBuffer: (fileId: string) => Promise<{
    buffer: Buffer;
    mimeType: string;
    name: string;
}>;
export declare const streamDriveFileContent: (fileId: string) => Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    name: string;
}>;
//# sourceMappingURL=googleDrive.d.ts.map