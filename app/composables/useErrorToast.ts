export function useErrorToast() {
  const toast = useToast();
  return (error: unknown) => {
    toast.add({
      title: errorReason(error, 'Something went wrong. Try again.'),
      color: 'error',
      icon: 'i-lucide-circle-alert',
    });
  };
}
