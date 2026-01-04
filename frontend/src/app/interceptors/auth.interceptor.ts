import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { getAuth } from 'firebase/auth';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isBackendRequest = req.url.startsWith(environment.backendUrl);
    if (!isBackendRequest) {
      return next.handle(req);
    }

    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return next.handle(req);
    }

    return from(currentUser.getIdToken()).pipe(
      mergeMap((token) => {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next.handle(authReq);
      })
    );
  }
}
