"use client";

interface QueueWidgetProps {
  waiting: number;
  processing: number;
  success: number;
  failed: number;
}

export default function QueueWidget({ waiting, processing, success, failed }: QueueWidgetProps) {
  const total = waiting + processing + success + failed || 1;
  const pctW = (waiting / total) * 100;
  const pctP = (processing / total) * 100;
  const pctS = (success / total) * 100;
  const pctF = (failed / total) * 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h4 className="text-sm font-extrabold text-slate-500 uppercase tracking-wide mb-4">Status Antrean</h4>

      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-5">
        {waiting > 0 && <div className="h-full bg-blue-500 transition-all" style={{ width: `${pctW}%` }} title={`Waiting: ${waiting}`} />}
        {processing > 0 && <div className="h-full bg-amber-400 animate-pulse transition-all" style={{ width: `${pctP}%` }} title={`Processing: ${processing}`} />}
        {success > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctS}%` }} title={`Success: ${success}`} />}
        {failed > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${pctF}%` }} title={`Failed: ${failed}`} />}
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { label: 'Waiting', count: waiting, color: 'text-blue-600 bg-blue-50' },
          { label: 'Proses', count: processing, color: 'text-amber-600 bg-amber-50' },
          { label: 'Sukses', count: success, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Gagal', count: failed, color: 'text-red-600 bg-red-50' },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center">
            <span className={`text-2xl font-black ${item.color.split(' ')[0]}`}>{item.count}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
