interface ErrorMessageProps {
    message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
    return (
        <div className="fixed left-50 top-50 z-[999] -translate-x-[-50%] -translate-y-[-50%] rounded bg-red-600/90 p-4 text-center text-white">
            {message}
        </div>
    );
}