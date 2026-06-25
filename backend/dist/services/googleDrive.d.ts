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
//# sourceMappingURL=googleDrive.d.ts.map