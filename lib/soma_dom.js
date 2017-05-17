// This is a collection of data attributes we decorate the DOM with to inform
// our packer about the semantic use of certain tags. For example, if a link
// tag which contains an image should be opened in a lightbox on the e-k-l
// side, it'd be decorated with data-soma-widget="ImageLink".

module.exports = {
    Widget: {
        Tag: 'data-soma-widget',
        Audio: 'Audio',
        AudioContainer: 'AudioContainer',
        ExternalLinks: 'ExternalLinks',
        Image: 'Image',
        ImageLink: 'ImageLink',
        Link: 'Link',
        Notes: 'Notes',
        References: 'References',
        RelatedLinks: 'RelatedLinks',
        TableOfContents: 'TableOfContents',
        Thumbnail: 'Thumbnail',
        Title: 'Title',
        Video: 'Video',
        VideoContainer: 'VideoContainer',
        VideoLink: 'VideoLink',
    },
    Hint: {
        Tag: 'data-soma-hint',
        ImportantImage: 'ImportantImage',
        InactiveLink: 'InactiveLink',
    },
};
