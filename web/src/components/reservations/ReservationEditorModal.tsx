import type { Role } from "../../types/domain";
import type { Station } from "../../types/domain";
import type { Reservation } from "../../types/domain";
import { BookingModal } from "./BookingModal";

export function ReservationEditorModal({
  role,
  stations,
  token,
  reservation,
  onClose,
  onSaved,
}: {
  role: Role;
  stations: Station[];
  token: string;
  reservation: Reservation;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <BookingModal
      role={role}
      stations={stations}
      token={token}
      reservation={reservation}
      onClose={onClose}
      onCreated={onSaved}
    />
  );
}
