export function LoadingScreen({ label = 'Загрузка…' }: { label?: string }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F4FD]">
            <p className="text-sm text-[#6B6880]">{label}</p>
        </div>
    )
}
