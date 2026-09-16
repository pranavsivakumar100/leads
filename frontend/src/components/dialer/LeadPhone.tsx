import { PhoneIcon } from "@/components/icons";
import { useDialer } from "@/hooks/useDialer";

export function LeadPhone({
  phone,
  name,
  placeId,
}: {
  phone: string;
  name: string;
  placeId?: string;
}) {
  const { openDialer } = useDialer();
  return (
    <button
      type="button"
      className="lead-call"
      onClick={() => openDialer({ number: phone, name, placeId })}
    >
      <PhoneIcon aria-hidden="true" />
      <span>{phone}</span>
    </button>
  );
}
