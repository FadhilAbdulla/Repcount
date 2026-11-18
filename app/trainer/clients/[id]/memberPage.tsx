import {memberPage as shared} from "../../../memberPage";
import type {MemberSection} from "../../../ClientDetail";

/** A trainer's view of one of their members; see app/memberPage.tsx. */
export const memberPage = (id: string, section: MemberSection, at: {week?: string; day?: string; month?: string} = {}) => shared("trainer", id, section, at);
