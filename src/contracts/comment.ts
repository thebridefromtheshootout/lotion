export interface Comment {
  id: string;
  /** The text that was selected when the comment was created */
  anchorText: string;
  /** Comment body */
  body: string;
  /** ISO timestamp */
  createdAt: string;
  /** Whether comment is resolved */
  resolved?: boolean;
  /** Username of the comment author */
  author?: string;
  /** line where the comment lives */
  line: number;
}
