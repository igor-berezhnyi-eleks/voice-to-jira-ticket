import {
  Box,
  IconButton,
  Link,
  Typography,
  LinearProgress,
  CircularProgress,
  Avatar,
  type SxProps,
  type Theme
} from '@mui/material';
import {
  UploadFileOutlined,
  DeleteOutlined,
  DoneOutlined
} from '@mui/icons-material';
import { useCallback } from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';

// FileUploadDropzone Component
interface FileUploadDropzoneProps {
  /** Callback when files are dropped */
  onDrop?: (files: File[]) => void;
  /** Text to display above the subtitle */
  title?: string;
  /** Subtitle text with instructions */
  subtitle?: string;
  /** Current state of the dropzone */
  state?: 'default' | 'active' | 'error';
  /** Error message to display when state is 'error' (replaces subtitle) */
  errorMessage?: string;
  /** Additional dropzone options */
  dropzoneOptions?: Omit<DropzoneOptions, 'onDrop'>;
  /** Custom styles using MUI sx prop */
  sx?: SxProps<Theme>;
}

export const FileUploadDropzone = ({
  onDrop,
  title = 'or drag and drop',
  subtitle = 'SVG, PNG, JPG or GIF (max. 3MB)',
  state = 'default',
  errorMessage = 'Unsuported file.',
  dropzoneOptions,
  sx
}: FileUploadDropzoneProps) => {
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      onDrop?.(acceptedFiles);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    ...dropzoneOptions
  });

  const isError = state === 'error';
  const isActive = state === 'active' || isDragActive;

  return (
    <Box
      {...getRootProps()}
      sx={{
        width: '100%',
        border: '1px dashed',
        borderRadius: '4px',
        pt: 4,
        pb: 3,
        ...(isError && {
          border: '1px solid',
          borderColor: 'error.main',
          bgcolor: 'error._states.hover'
        }),
        ...(isActive &&
          !isError && {
            borderColor: 'primary.main',
            bgcolor: 'primary._states.hover'
          }),
        ...(!isActive &&
          !isError && {
            borderColor: 'action.disabledBackground'
          }),
        ...sx
      }}
    >
      <input {...getInputProps()} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1
        }}
      >
        <UploadFileOutlined
          color={isError ? 'error' : 'primary'}
          sx={{ mb: 1 }}
        />
        <Typography variant="subtitle1">
          <Link>Link</Link> {title}
        </Typography>
        <Typography
          variant="body2"
          color={isError ? 'error' : 'secondary.dark'}
        >
          {isError ? errorMessage : subtitle}
        </Typography>
      </Box>
    </Box>
  );
};

// FileUploadItem Component
export interface FileUploadItemData {
  /** File name */
  name: string;
  /** File size as string */
  size: string;
  /** Whether file is currently uploading */
  isLoading?: boolean;
  /** Error message if upload failed */
  error?: string;
  /** Upload progress (0-100) */
  progress?: number;
}

interface FileUploadItemProps {
  /** File data */
  file: FileUploadItemData;
  /** Loading indicator type */
  loadingType?: 'linear' | 'circular';
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Custom styles using MUI sx prop */
  sx?: SxProps<Theme>;
}

export const FileUploadItem = ({
  file,
  loadingType = 'linear',
  onDelete,
  sx
}: FileUploadItemProps) => {
  const { name, size, isLoading, error, progress } = file;
  const hasError = !!error;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <UploadFileOutlined color={hasError ? 'error' : 'primary'} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          ml: 2,
          mr: 1,
          minWidth: 0
        }}
      >
        <Typography
          variant="subtitle1"
          color={hasError ? 'error' : 'text'}
          noWrap
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {hasError ? 'Upload failed.' : name}
        </Typography>
        <Typography
          variant="body2"
          color={hasError ? 'error' : 'secondary.dark'}
        >
          {hasError ? error : size} •{' '}
          {isLoading ? 'Loading' : hasError ? 'Failed' : 'Complete'}
        </Typography>
        {loadingType === 'linear' && (
          <LinearProgress
            sx={{ mt: '2px' }}
            color={hasError ? 'error' : 'primary'}
            value={hasError ? 0 : progress ?? 0}
            variant={isLoading ? 'indeterminate' : 'determinate'}
          />
        )}
      </Box>
      <IconButton aria-label="delete" onClick={onDelete}>
        <DeleteOutlined color="action" />
      </IconButton>
      {loadingType === 'circular' && (
        <>
          {isLoading && <CircularProgress sx={{ ml: 3 }} />}
          {!isLoading && !hasError && (
            <Avatar
              variant="circular"
              sx={{
                width: '24px',
                height: '24px',
                bgcolor: 'success.main',
                ml: 3
              }}
            >
              <DoneOutlined
                color="action"
                sx={{ width: '20px', height: '20px' }}
              />
            </Avatar>
          )}
        </>
      )}
    </Box>
  );
};

// FileUpload Component (Complete)
interface FileUploadProps {
  /** List of files */
  files?: FileUploadItemData[];
  /** Callback when files are dropped */
  onDrop?: (files: File[]) => void;
  /** Callback when delete button is clicked */
  onDeleteFile?: (index: number) => void;
  /** Loading indicator type for items */
  loadingType?: 'linear' | 'circular';
  /** Dropzone title */
  dropzoneTitle?: string;
  /** Dropzone subtitle */
  dropzoneSubtitle?: string;
  /** Dropzone state */
  dropzoneState?: 'default' | 'active' | 'error';
  /** Error message for dropzone when state is 'error' */
  dropzoneErrorMessage?: string;
  /** Additional dropzone options */
  dropzoneOptions?: Omit<DropzoneOptions, 'onDrop'>;
  /** Custom styles using MUI sx prop */
  sx?: SxProps<Theme>;
}

export const FileUpload = ({
  files = [],
  onDrop,
  onDeleteFile,
  loadingType = 'linear',
  dropzoneTitle,
  dropzoneSubtitle,
  dropzoneState = 'default',
  dropzoneErrorMessage,
  dropzoneOptions,
  sx
}: FileUploadProps) => {
  return (
    <Box
      data-testid="FileUpload"
      sx={{
        width: { xs: '100%', sm: 600 },
        minWidth: '320px',
        maxWidth: '100%',
        ...sx
      }}
    >
      <FileUploadDropzone
        onDrop={onDrop}
        title={dropzoneTitle}
        subtitle={dropzoneSubtitle}
        state={dropzoneState}
        errorMessage={dropzoneErrorMessage}
        dropzoneOptions={dropzoneOptions}
      />
      {files.length > 0 && (
        <Box
          sx={{ p: 2.0, display: 'flex', flexDirection: 'column', gap: 3.5 }}
        >
          {files.map((file, index) => (
            <FileUploadItem
              key={`${file.name}-${index}`}
              file={file}
              loadingType={loadingType}
              onDelete={() => onDeleteFile?.(index)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
