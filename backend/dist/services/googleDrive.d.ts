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
//# sourceMappingURL=googleDrive.d.ts.map