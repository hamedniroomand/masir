export function svgToPngBlob(svgUrl: string, size = 1000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      image.src = '';
      reject(new Error('Rasterization timed out'));
    }, 5000);

    image.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        context.drawImage(image, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas export failed'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      }
      catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Image load failed'));
    };

    image.src = svgUrl;
  });
}
