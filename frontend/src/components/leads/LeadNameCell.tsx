import type { LeadHours } from "@/lib/hours";
import { hoursStatus } from "@/lib/hours";

interface LeadNameCellProps {
  name: string;
  address?: string;
  mapsUri?: string;
  hours?: LeadHours | null;
  status?: string;
}

export function LeadNameCell({
  name,
  address,
  mapsUri,
  hours,
  status,
}: LeadNameCellProps) {
  const hoursInfo = hoursStatus(hours, status);

  return (
    <>
      <div className="lead-name-row">
        {mapsUri ? (
          <a
            href={mapsUri}
            target="_blank"
            rel="noreferrer"
            className="lead-name"
          >
            {name}
          </a>
        ) : (
          <span className="lead-name">{name}</span>
        )}
        {hoursInfo && (
          <span
            className={`badge badge--hours badge--hours-${hoursInfo.kind}`}
            title={hoursInfo.title}
            aria-label={hoursInfo.title.replace(/\n/g, " · ")}
          >
            {hoursInfo.label}
          </span>
        )}
      </div>
      {address ? <div className="lead-address">{address}</div> : null}
    </>
  );
}
