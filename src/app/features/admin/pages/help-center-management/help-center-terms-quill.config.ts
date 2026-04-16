import { QuillModules } from 'ngx-quill/config';

/** Shared toolbar: formatting + RTL + images (base64 or pasted URLs); no paid Quill plugins. */
export const HELP_CENTER_TERMS_QUILL_MODULES: QuillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ script: 'sub' }, { script: 'super' }],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    [{ direction: 'rtl' }],
    ['blockquote'],
    ['link', 'image'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false
  }
};

/** Same modules as terms (rich help articles + images). */
export const HELP_CENTER_ARTICLES_QUILL_MODULES = HELP_CENTER_TERMS_QUILL_MODULES;
