import { BadRequestException, Injectable } from '@nestjs/common';
import { UserScopeService } from '../../rbac/user-scope.service';
import { HOSPITAL_MANAGER_ROLE_NAME } from '../../../common/constants/roles.constants';

const DEFAULT_UNRESTRICTED_ROLES = [HOSPITAL_MANAGER_ROLE_NAME];

@Injectable()
export class ReportAccessService {
    constructor(private readonly userScopeService: UserScopeService) {}

    async resolveDepartmentScope(
        requestingUserId: string,
        unrestrictedRoles: string[] = DEFAULT_UNRESTRICTED_ROLES,
    ): Promise<string | null> {
        const scope =
            await this.userScopeService.getUserScope(requestingUserId);
        if (!scope) throw new BadRequestException('المستخدم الطالب غير موجود.');

        if (scope.isSuperAdmin || unrestrictedRoles.includes(scope.roleName))
            return null;
        return scope.departmentId;
    }
}
