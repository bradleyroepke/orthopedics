'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LandmarkToggleProps {
  documentId: string;
}

export function LandmarkToggle({ documentId }: LandmarkToggleProps) {
  const [isLandmark, setIsLandmark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/documents/${documentId}/landmark`);
        if (res.ok) {
          const data = await res.json();
          setIsLandmark(data.isLandmark);
        }
      } catch (error) {
        console.error('Failed to check landmark status:', error);
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [documentId]);

  const toggleLandmark = async () => {
    setUpdating(true);
    try {
      const method = isLandmark ? 'DELETE' : 'POST';
      const res = await fetch(`/api/documents/${documentId}/landmark`, {
        method,
      });

      if (res.ok) {
        setIsLandmark(!isLandmark);
      }
    } catch (error) {
      console.error('Failed to toggle landmark:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Star className="h-4 w-4" />
        Loading...
      </Button>
    );
  }

  return (
    <Button
      variant={isLandmark ? 'default' : 'outline'}
      size="sm"
      onClick={toggleLandmark}
      disabled={updating}
      className={cn(
        'gap-2 transition-all',
        isLandmark && 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
      )}
    >
      <Star
        className={cn('h-4 w-4', isLandmark && 'fill-current')}
      />
      {updating
        ? 'Saving...'
        : isLandmark
          ? 'Landmark'
          : 'Mark as Landmark'}
    </Button>
  );
}
