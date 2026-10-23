# FAQ sets

One file per set, `<key>.yaml`, from `../_templates/faq.yaml`; a page shows a
set with a `faq` section that names its key (`set: <key>`), and its FAQPage
structured data reads the same set. None yet. The folder stays even while it
holds no set: the content engine reads it on every build, and a file whose
name starts with `_`, like this one, is never read as content.
