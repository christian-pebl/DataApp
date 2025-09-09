'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { sharingService } from '@/lib/supabase/sharing-service';
import { fileStorageService } from '@/lib/supabase/file-storage-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MapPin,
  FileText,
  Download,
  Lock,
  Eye,
  Edit,
  Loader2,
  AlertCircle,
  Calendar,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import map component to avoid SSR issues
const MapDisplay = dynamic(() => import('@/components/map/SharedMapDisplay'), {
  ssr: false,
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-lg" />
});

interface PinData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  notes?: string;
  created_at: string;
  user?: {
    email: string;
  };
}

interface PinFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
}

export default function SharedPinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState<PinData | null>(null);
  const [files, setFiles] = useState<PinFile[]>([]);
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateAndLoadPin();
  }, [token]);

  const validateAndLoadPin = async (pwd?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Validate token
      const validation = await sharingService.validateToken(token, pwd);

      if (!validation.valid) {
        if (validation.error === 'Password required') {
          setPasswordRequired(true);
          setLoading(false);
          return;
        }
        setError(validation.error || 'Invalid share link');
        setLoading(false);
        return;
      }

      // Set pin data and permission
      setPin(validation.data.pin);
      setPermission(validation.data.permission);

      // Load pin files
      if (validation.data.pin) {
        const pinFiles = await fileStorageService.getPinFiles(validation.data.pin.id);
        setFiles(pinFiles);
      }

      setPasswordRequired(false);
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading shared pin:', error);
      setError('Failed to load shared content');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndLoadPin(password);
  };

  const handleDownloadFile = async (file: PinFile) => {
    try {
      const blob = await fileStorageService.downloadFile(file.filePath);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${file.fileName}`);
      }
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Protected
            </CardTitle>
            <CardDescription>
              This shared content is password protected. Please enter the password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full">
                <Lock className="h-4 w-4 mr-2" />
                Unlock
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => router.push('/')}
              className="w-full mt-4"
              variant="outline"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Content Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The shared content could not be found or may have been removed.
            </p>
            <Button
              onClick={() => router.push('/')}
              className="w-full mt-4"
              variant="outline"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {pin.label}
                </CardTitle>
                <CardDescription>
                  Shared pin with {permission} access
                </CardDescription>
              </div>
              <Badge variant={permission === 'edit' ? 'default' : 'secondary'}>
                {permission === 'edit' ? (
                  <Edit className="h-3 w-3 mr-1" />
                ) : (
                  <Eye className="h-3 w-3 mr-1" />
                )}
                {permission}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Shared by:</span>
                <span>{pin.user?.email || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(pin.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Location:</span>
                <span>{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span>
              </div>
            </div>

            {pin.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{pin.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map Display */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 rounded-lg overflow-hidden">
              <MapDisplay
                center={[pin.lng, pin.lat]}
                pins={[{
                  id: pin.id,
                  coordinates: [pin.lng, pin.lat],
                  label: pin.label
                }]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Files */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Attached Files ({files.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.fileSize)} • {file.fileType}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadFile(file)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {permission === 'edit' && (
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={() => router.push(`/map-drawing?editPin=${pin.id}`)}
                className="w-full"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Pin
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}