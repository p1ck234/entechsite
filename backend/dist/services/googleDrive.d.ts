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
export declare const listImagesInDriveResource: (resourceIdOrUrl: string) => Promise<DriveFileItem[]>;
export declare const streamDriveFileContent: (fileId: string) => Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    name: string;
}>;
//# sourceMappingURL=googleDrive.d.ts.map