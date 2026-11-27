(() => {
  'use strict';

  const list = document.getElementById('reviewList');
  const summary = document.getElementById('reviewSummary');
  const form = document.getElementById('publicReviewForm');
  const projectSelect = document.getElementById('reviewProject');
  const status = document.getElementById('reviewStatus');
  const submit = document.getElementById('reviewSubmit');
  const commentList = document.getElementById('imageCommentList');
  const commentForm = document.getElementById('imageCommentForm');
  const commentProject = document.getElementById('commentProject');
  const commentImage = document.getElementById('commentImage');
  const commentStatus = document.getElementById('commentStatus');
  const commentSubmit = document.getElementById('commentSubmit');
  let projectsBySlug = new Map();

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function stars(rating) {
    const node = el('span', 'review-stars', '★'.repeat(Math.max(0, Math.min(5, Number(rating)))));
    node.setAttribute('aria-label', `${rating} out of 5 stars`);
    return node;
  }

  function renderReview(review) {
    const article = el('article', 'review-card');
    const header = el('header');
    header.append(el('span', 'review-name', review.displayName), stars(review.rating));
    article.append(header, el('p', 'review-text', review.text));
    const date = review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' }) : '';
    article.append(el('span', 'review-project', `${review.projectTitle || 'Portfolio project'} · ${date}`));
    return article;
  }

  function renderImageComment(comment) {
    const article = el('article', 'review-card image-comment-card');
    const image = el('img', 'image-comment-preview');
    image.src = comment.mediaUrl;
    image.alt = '';
    image.loading = 'lazy';
    const header = el('header');
    header.append(el('span', 'review-name', comment.displayName), el('span', 'review-date', comment.projectTitle || 'Project'));
    article.append(image, header, el('p', 'review-text', comment.text));
    if (comment.reply) {
      const reply = el('p', 'image-comment-reply', comment.reply);
      reply.prepend(el('strong', '', 'Kuldeep replied: '));
      article.append(reply);
    }
    return article;
  }

  function updateCommentImages() {
    const project = projectsBySlug.get(commentProject.value);
    commentImage.replaceChildren();
    const images = project ? [project.cover && { url: project.cover, alt: project.coverAlt || 'Cover image' }, ...(project.gallery || [])].filter((item) => item && item.url) : [];
    const placeholder = el('option', '', images.length ? 'Choose an image' : 'No images available');
    placeholder.value = '';
    commentImage.append(placeholder);
    images.forEach((image, index) => {
      const option = el('option', '', image.alt || `Project image ${index + 1}`);
      option.value = image.url;
      commentImage.append(option);
    });
    commentImage.disabled = !images.length;
  }

  async function loadReviews() {
    try {
      const [reviewsResponse, siteResponse] = await Promise.all([fetch('/api/reviews'), fetch('/api/site')]);
      if (!reviewsResponse.ok || !siteResponse.ok) throw new Error('Reviews are temporarily unavailable. Please try again later.');
      const reviewData = await reviewsResponse.json();
      const site = await siteResponse.json();
      const projects = site.projects || [];
      projectsBySlug = new Map(projects.map((project) => [project.slug, project]));
      projects.forEach((project) => {
        const option = el('option', '', project.title);
        option.value = project.slug;
        projectSelect.append(option);
        if (commentProject) {
          const commentOption = el('option', '', project.title);
          commentOption.value = project.slug;
          commentProject.append(commentOption);
        }
      });
      const selectedProject = new URLSearchParams(location.search).get('project');
      if (selectedProject && projectsBySlug.has(selectedProject)) {
        commentProject.value = selectedProject;
        updateCommentImages();
      }
      const rating = reviewData.rating || { average: 0, count: 0 };
      summary.textContent = rating.count ? `${rating.average} / 5 · ${rating.count} approved review${rating.count === 1 ? '' : 's'}` : 'No approved reviews yet.';
      list.replaceChildren();
      const reviews = reviewData.reviews || [];
      if (!reviews.length) {
        list.append(el('p', 'reviews-empty', 'No approved reviews yet. If you have worked on a project, share your feedback here.'));
      } else {
        reviews.forEach((review) => list.append(renderReview(review)));
      }
      await loadImageComments();
    } catch (error) {
      summary.textContent = '';
      list.replaceChildren(el('p', 'reviews-empty', error.message));
    }
  }

  async function loadImageComments() {
    if (!commentList) return;
    try {
      const response = await fetch('/api/comments');
      if (!response.ok) throw new Error('Image comments are temporarily unavailable.');
      const data = await response.json();
      const comments = data.comments || [];
      commentList.replaceChildren();
      if (!comments.length) commentList.append(el('p', 'reviews-empty', 'No approved image comments yet.'));
      else comments.forEach((comment) => commentList.append(renderImageComment(comment)));
    } catch (error) {
      commentList.replaceChildren(el('p', 'reviews-empty', error.message));
    }
  }

  if (commentProject) commentProject.addEventListener('change', updateCommentImages);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    const rating = form.querySelector('input[name="rating"]:checked');
    const payload = {
      projectSlug: projectSelect.value,
      rating: rating ? Number(rating.value) : 0,
      displayName: document.getElementById('reviewName').value.trim(),
      text: document.getElementById('reviewText').value.trim(),
      consent: document.getElementById('reviewConsent').checked,
      website: form.elements.website.value
    };
    submit.disabled = true;
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your review could not be submitted.');
      status.dataset.state = 'success';
      status.textContent = result.message || 'Thank you. Your review is awaiting approval.';
      form.reset();
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.message;
    } finally {
      status.hidden = false;
      submit.disabled = false;
    }
  });

  if (commentForm) commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    commentStatus.hidden = true;
    commentSubmit.disabled = true;
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: commentProject.value,
          mediaUrl: commentImage.value,
          displayName: document.getElementById('commentName').value.trim(),
          text: document.getElementById('commentText').value.trim(),
          consent: document.getElementById('commentConsent').checked,
          website: commentForm.elements.website.value
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your comment could not be submitted.');
      commentStatus.dataset.state = 'success';
      commentStatus.textContent = result.message || 'Thanks — your comment is awaiting approval.';
      commentForm.reset();
      updateCommentImages();
    } catch (error) {
      commentStatus.dataset.state = 'error';
      commentStatus.textContent = error.message;
    } finally {
      commentStatus.hidden = false;
      commentSubmit.disabled = false;
    }
  });

  loadReviews();
})();
