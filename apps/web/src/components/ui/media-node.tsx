'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement } from 'platejs/react';
import { cn } from '@/lib/utils';
import { Image, Video, File, Music } from 'lucide-react';

export function ImageElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';
  const alt = (element?.alt as string) || '';

  // Handle base64 images
  const imageUrl = url?.startsWith('data:image') ? url : url;

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn('my-4', className)}
      {...rest}
    >
      {url && (
        <img
          src={imageUrl}
          alt={alt}
          className="max-w-full rounded-md"
          style={{ maxHeight: '500px' }}
        />
      )}
      {children}
    </PlateElement>
  );
}

export function VideoElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';

  // Handle base64 videos
  const videoUrl = url?.startsWith('data:video') ? url : url;

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn('my-4', className)}
      {...rest}
    >
      {url && (
        <video
          src={videoUrl}
          controls
          className="max-w-full rounded-md"
          style={{ maxHeight: '500px' }}
        >
          Your browser does not support the video tag.
        </video>
      )}
      {children}
    </PlateElement>
  );
}

export function AudioElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';

  // Handle base64 audio
  const audioUrl = url?.startsWith('data:audio') ? url : url;

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn('my-4', className)}
      {...rest}
    >
      {url && (
        <audio src={audioUrl} controls className="w-full">
          Your browser does not support the audio tag.
        </audio>
      )}
      {children}
    </PlateElement>
  );
}

export function FileElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';
  const filename = (element?.filename as string) || 'File';

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn(
        'my-4 flex items-center gap-3 rounded-md border p-3',
        className
      )}
      {...rest}
    >
      <File className="h-5 w-5" />
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {filename}
        </a>
      )}
      {children}
    </PlateElement>
  );
}

export function MediaEmbedElement(props: PlateElementProps) {
  const { children, element, className, ...rest } = props;
  const url = (element?.url as string) || '';

  return (
    <PlateElement
      element={element}
      as="div"
      className={cn('my-4', className)}
      {...rest}
    >
      {url && (
        <iframe
          src={url}
          className="w-full rounded-md"
          style={{ minHeight: '400px' }}
          allowFullScreen
          title="Embedded media"
        />
      )}
      {children}
    </PlateElement>
  );
}

